/**
 * Manufacturer Spec Linker — PES Engine
 * Links manufacturer PDFs (datasheets, manuals, warranties) to Shopify products via metafields
 */

import { prisma } from "../db.server";
import fs from "fs";
import path from "path";
import { parsePDF } from "../utils/pdf-utils.js";

export async function uploadSpecSheet({
  file,
  productSku,
  manufacturerId,
  type = "datasheet",
  title,
  notes = "",
}) {
  // Validate file
  const allowedTypes = ["application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Only PDF files are allowed");
  }

  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    throw new Error(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
  }

  // Generate filename
  const timestamp = Date.now();
  const safeTitle = title ? title.replace(/[^a-z0-9]/gi, "_") : "spec";
  const filename = `${manufacturerId}_${productSku}_${type}_${safeTitle}_${timestamp}.pdf`;
  const uploadDir = process.env.UPLOAD_DIR || "./data/uploads";
  const filePath = path.join(uploadDir, filename);

  // Ensure directory exists
  fs.mkdirSync(uploadDir, { recursive: true });

  // Save file
  fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));

  // Extract metadata from PDF if possible
  let metadata = {};
  try {
    const pdfData = parsePDF(filePath);
    metadata = {
      pages: pdfData.pages,
      title: pdfData.title || title,
      author: pdfData.author,
      creationDate: pdfData.creationDate,
    };
  } catch (e) {
    metadata = { error: "Could not extract PDF metadata" };
  }

  // Create spec record
  const spec = await prisma.manufacturerSpec.create({
    data: {
      manufacturerId,
      productSku,
      type,
      title: title || metadata.title || "Specification Document",
      filePath,
      fileUrl: `/uploads/${filename}`,
      fileSize: file.size,
      metadata: JSON.stringify(metadata),
      notes,
    },
  });

  // Link to Shopify product metafields
  await linkSpecToShopify(productSku, spec);

  return spec;
}

export async function linkSpecToShopify(productSku, spec) {
  const shopifyProduct = await prisma.shopifyProduct.findUnique({
    where: { sku: productSku },
  });

  if (!shopifyProduct) {
    return { status: "skipped", reason: "Product not found in Shopify" };
  }

  const metafieldNamespace = "specs";
  const metafieldKey = `${spec.type}_url`;

  // Update local cache
  await prisma.shopifyProduct.update({
    where: { id: shopifyProduct.id },
    data: {
      metafields: JSON.stringify({
        ...JSON.parse(shopifyProduct.metafields || "{}"),
        [metafieldNamespace]: {
          ...JSON.parse(shopifyProduct.metafields || "{}")[metafieldNamespace],
          [metafieldKey]: spec.fileUrl,
        },
      }),
    },
  });

  // Push to Shopify via metafield API
  // This would be done via shopify-sync.js
  return { status: "linked", metafieldNamespace, metafieldKey, url: spec.fileUrl };
}

export async function getSpecsForProduct(productSku) {
  return prisma.manufacturerSpec.findMany({
    where: { productSku },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSpecsForManufacturer(manufacturerId) {
  return prisma.manufacturerSpec.findMany({
    where: { manufacturerId },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteSpec(specId) {
  const spec = await prisma.manufacturerSpec.findUnique({
    where: { id: specId },
  });

  if (!spec) throw new Error("Spec not found");

  // Delete file
  if (fs.existsSync(spec.filePath)) {
    fs.unlinkSync(spec.filePath);
  }

  return prisma.manufacturerSpec.delete({
    where: { id: specId },
  });
}

export async function updateSpecMetadata(specId, metadata) {
  return prisma.manufacturerSpec.update({
    where: { id: specId },
    data: { metadata: JSON.stringify(metadata) },
  });
}
