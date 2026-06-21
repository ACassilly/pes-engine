#!/bin/bash
# PES Engine — Database Seed Script
# Seeds database with PES vendor data and configurations

set -e

echo "========================================="
echo "PES Engine — Database Seed"
echo "========================================="

# Seed vendors
echo "🏭 Seeding vendors..."

node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const vendors = [
    { code: 'generac', name: 'Generac Power Systems', contactName: 'Jennifer Weiss / Spencer Warmuth', portalUrl: 'https://www.generac.com/whs-gold' },
    { code: 'cummins', name: 'Cummins Inc.', contactName: 'Jaime Gilmore', portalUrl: 'https://www.cummins.com/dealer-portal' },
    { code: 'eg4', name: 'EG4 Electronics', contactName: 'Anthony Dawood', portalUrl: 'https://www.eg4electronics.com/dealer' },
    { code: 'enphase', name: 'Enphase Energy', contactName: '', portalUrl: 'https://www.enphase.com/partner-portal' },
    { code: 'solaredge', name: 'SolarEdge Technologies', contactName: '', portalUrl: 'https://www.solaredge.com/monitoring' },
    { code: 'sma', name: 'SMA Solar Technology', contactName: '', portalUrl: 'https://www.sma-america.com' },
    { code: 'fronius', name: 'Fronius International', contactName: '', portalUrl: 'https://www.fronius.com' },
    { code: 'sol-ark', name: 'Sol-Ark', contactName: '', portalUrl: 'https://www.sol-ark.com' },
    { code: 'victron', name: 'Victron Energy', contactName: '', portalUrl: 'https://www.victronenergy.com' },
    { code: 'jinko', name: 'Jinko Solar', contactName: '', portalUrl: 'https://www.jinkosolar.com' },
    { code: 'trina', name: 'Trina Solar', contactName: '', portalUrl: 'https://www.trinasolar.com' },
    { code: 'canadian-solar', name: 'Canadian Solar', contactName: '', portalUrl: 'https://www.canadiansolar.com' },
    { code: 'rec', name: 'REC Group', contactName: '', portalUrl: 'https://www.rec-group.com' },
  ];

  for (const v of vendors) {
    await prisma.vendor.upsert({
      where: { code: v.code },
      update: {},
      create: v,
    });
    console.log('✅ Vendor:', v.name);
  }

  // Seed competitors
  const competitors = [
    { name: 'a1solarstore', displayName: 'A1 Solar Store', url: 'https://www.a1solarstore.com' },
    { name: 'ussolarsupplier', displayName: 'US Solar Supplier', url: 'https://www.ussolarsupplier.com' },
    { name: 'altestore', displayName: 'altE Store', url: 'https://www.altestore.com' },
    { name: 'wholesalesolar', displayName: 'Wholesale Solar', url: 'https://www.wholesalesolar.com' },
    { name: 'signaturesolar', displayName: 'Signature Solar', url: 'https://www.signaturesolar.com' },
  ];

  for (const c of competitors) {
    await prisma.competitor.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
    console.log('✅ Competitor:', c.displayName);
  }

  console.log('\n🌱 Seed complete!');
  await prisma.\$disconnect();
}

seed().catch(e => {
  console.error(e);
  prisma.\$disconnect();
  process.exit(1);
});
"

echo ""
echo "========================================="
echo "✅ Database seeded successfully!"
echo "========================================="
