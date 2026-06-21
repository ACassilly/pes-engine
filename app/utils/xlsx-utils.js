import * as XLSX from "xlsx";
import fs from "fs";

/**
 * Excel/Spreadsheet Utilities — PES Engine
 * Handles XLSX/XLS parsing, generation, and manipulation
 */

/**
 * Read Excel file and return all sheets as object
 */
export function readExcel(filePath, options = {}) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, ...options });
  const sheets = {};
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    sheets[sheetName] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, ...options });
  }
  
  return sheets;
}

/**
 * Read Excel and return first sheet as array of objects (with headers)
 */
export function readExcelAsObjects(filePath, sheetName = null, options = {}) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, ...options });
  const targetSheet = sheetName || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[targetSheet];
  
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, ...options });
}

/**
 * Write data to Excel file with multiple sheets
 */
export function writeExcel(filePath, data, options = {}) {
  const workbook = XLSX.utils.book_new();
  
  for (const [sheetName, sheetData] of Object.entries(data)) {
    let worksheet;
    
    if (Array.isArray(sheetData) && sheetData.length > 0 && Array.isArray(sheetData[0])) {
      // Array of arrays (with headers)
      worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    } else if (Array.isArray(sheetData)) {
      // Array of objects
      worksheet = XLSX.utils.json_to_sheet(sheetData);
    } else {
      worksheet = XLSX.utils.json_to_sheet([sheetData]);
    }
    
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }
  
  XLSX.writeFile(workbook, filePath, options);
  return filePath;
}

/**
 * Write single sheet to Excel
 */
export function writeExcelSheet(filePath, sheetName, data, options = {}) {
  const workbook = XLSX.utils.book_new();
  let worksheet;
  
  if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
    worksheet = XLSX.utils.aoa_to_sheet(data);
  } else {
    worksheet = XLSX.utils.json_to_sheet(data);
  }
  
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filePath, options);
  return filePath;
}

/**
 * Convert Excel to CSV (one sheet per CSV file)
 */
export function convertExcelToCSV(filePath, outputDir) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const outputFiles = [];
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    
    const safeSheetName = sheetName.replace(/[^a-z0-9]/gi, "_");
    const outputPath = `${outputDir}/${safeSheetName}.csv`;
    
    fs.writeFileSync(outputPath, csv, "utf-8");
    outputFiles.push(outputPath);
  }
  
  return outputFiles;
}

/**
 * Merge multiple Excel files into one workbook
 */
export function mergeExcelFiles(filePaths, outputPath, options = {}) {
  const mergedWorkbook = XLSX.utils.book_new();
  
  for (const filePath of filePaths) {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const safeSheetName = `${sheetName}_${filePaths.indexOf(filePath)}`;
      XLSX.utils.book_append_sheet(mergedWorkbook, worksheet, safeSheetName);
    }
  }
  
  XLSX.writeFile(mergedWorkbook, outputPath, options);
  return outputPath;
}

/**
 * Extract data from a specific range in an Excel sheet
 */
export function extractRange(filePath, sheetName, range) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const worksheet = workbook.Sheets[sheetName || workbook.SheetNames[0]];
  
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range, raw: false });
  return data;
}

/**
 * Validate Excel file
 */
export function validateExcel(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: "File does not exist" };
    }
    
    const stats = fs.statSync(filePath);
    const maxSize = 100 * 1024 * 1024; // 100MB
    
    if (stats.size > maxSize) {
      return { valid: false, error: `File exceeds maximum size (${maxSize / 1024 / 1024}MB)` };
    }
    
    // Try to read the file
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    
    if (workbook.SheetNames.length === 0) {
      return { valid: false, error: "No sheets found in workbook" };
    }
    
    return { valid: true, sheetCount: workbook.SheetNames.length, size: stats.size };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Get sheet names from Excel file
 */
export function getSheetNames(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  return workbook.SheetNames;
}
