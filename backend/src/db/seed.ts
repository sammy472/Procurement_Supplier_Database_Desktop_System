import { db } from "./index";
import * as schema from "./schema";
import * as bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

async function seed() {
  console.log("Seeding database...");

  try {
    // Create users
    const adminPassword = await bcrypt.hash("admin123", 10);
    const procurementPassword = await bcrypt.hash("procurement123", 10);
    const engineerPassword = await bcrypt.hash("engineer123", 10);
    const viewerPassword = await bcrypt.hash("viewer123", 10);

    const [
      adminOnk,
      procurementOnk,
      engineerOnk,
      viewerOnk,
      adminSavy,
      procurementSavy,
      engineerSavy,
      viewerSavy,
    ] = await db
      .insert(schema.users)
      .values([
        {
          email: "admin@onkgroup.co.uk",
          password: adminPassword,
          firstName: "Admin",
          lastName: "User",
          role: "admin",
          company: "ONK_GROUP",
        },
        {
          email: "procurement@onkgroup.co.uk",
          password: procurementPassword,
          firstName: "Procurement",
          lastName: "Officer",
          role: "procurement_officer",
          company: "ONK_GROUP",
        },
        {
          email: "engineer@onkgroup.co.uk",
          password: engineerPassword,
          firstName: "John",
          lastName: "Engineer",
          role: "engineer",
          company: "ONK_GROUP",
        },
        {
          email: "viewer@onkgroup.co.uk",
          password: viewerPassword,
          firstName: "Viewer",
          lastName: "User",
          role: "viewer",
          company: "ONK_GROUP",
        },
        // Ant Savy users with antsavy.com domain
        {
          email: "admin@antsavy.co.uk",
          password: adminPassword,
          firstName: "Admin",
          lastName: "Savy",
          role: "admin",
          company: "ANT_SAVY",
        },
        {
          email: "procurement@antsavy.co.uk",
          password: procurementPassword,
          firstName: "Procurement",
          lastName: "Savy",
          role: "procurement_officer",
          company: "ANT_SAVY",
        },
        {
          email: "engineer@antsavy.co.uk",
          password: engineerPassword,
          firstName: "Jane",
          lastName: "Engineer",
          role: "engineer",
          company: "ANT_SAVY",
        },
        {
          email: "viewer@antsavy.co.uk",
          password: viewerPassword,
          firstName: "Viewer",
          lastName: "Savy",
          role: "viewer",
          company: "ANT_SAVY",
        },
      ])
      .onConflictDoNothing({ target: schema.users.email })
      .returning();

    // Create suppliers
    const [supplier1, supplier2, supplier3] = await db
      .insert(schema.suppliers)
      .values([
        {
          name: "ABC Electrical Supplies",
          category: "Electrical",
          address: "123 Main Street, Industrial Area",
          email: "contact@abcelectrical.com",
          phone: "+1234567890",
          country: "USA",
          contactPerson: "John Smith",
          reliabilityRating: 5,
          notes: "Preferred supplier for electrical components",
          isActive: true,
          createdBy: adminOnk.id,
        },
        {
          name: "XYZ Automation Co.",
          category: "Automation",
          address: "456 Tech Boulevard",
          email: "sales@xyzautomation.com",
          phone: "+0987654321",
          country: "Canada",
          contactPerson: "Jane Doe",
          reliabilityRating: 4,
          notes: "Specializes in PLC and automation equipment",
          isActive: true,
          createdBy: adminOnk.id,
        },
        {
          name: "Global Cables Ltd",
          category: "Cables",
          address: "789 Cable Road",
          email: "info@globalcables.com",
          phone: "+1122334455",
          country: "UK",
          contactPerson: "Mike Johnson",
          reliabilityRating: 5,
          notes: "High-quality cable manufacturer",
          isActive: true,
          createdBy: adminOnk.id,
        },
      ])
      .returning();

    // Create materials
    const [material1, material2, material3, material4] = await db
      .insert(schema.materials)
      .values([
        {
          name: "Circuit Breaker 32A",
          description: "32 Amp single pole circuit breaker",
          technicalSpec: "Type: MCB, Rating: 32A, Voltage: 230V AC, Breaking Capacity: 6kA",
          category: "Breaker",
          partNumber: "CB-32A-SP",
          unitOfMeasure: "Unit",
          brand: "Schneider",
          manufacturer: "Schneider Electric",
          defaultSupplierId: supplier1.id,
          minimumStockLevel: 10,
          createdBy: adminOnk.id,
        },
        {
          name: "PLC Module S7-1200",
          description: "Siemens S7-1200 PLC CPU module",
          technicalSpec: "CPU 1214C DC/DC/DC, 14 DI, 10 DO, 2 AI",
          category: "PLC",
          partNumber: "6ES7214-1AG40-0XB0",
          unitOfMeasure: "Unit",
          brand: "Siemens",
          manufacturer: "Siemens AG",
          defaultSupplierId: supplier2.id,
          minimumStockLevel: 5,
          createdBy: adminOnk.id,
        },
        {
          name: "Power Cable 3x2.5mm²",
          description: "3-core power cable, 2.5mm² cross-section",
          technicalSpec: "3-core, 2.5mm², PVC insulated, 300/500V",
          category: "Cable",
          partNumber: "CBL-3X2.5-PVC",
          unitOfMeasure: "Meter",
          brand: "Generic",
          manufacturer: "Global Cables Ltd",
          defaultSupplierId: supplier3.id,
          minimumStockLevel: 100,
          createdBy: adminOnk.id,
        },
        {
          name: "Motor Starter 11kW",
          description: "Direct online motor starter for 11kW motor",
          technicalSpec: "Rating: 11kW, Voltage: 400V, 3-phase, IP65",
          category: "Motor Control",
          partNumber: "MS-11KW-DOL",
          unitOfMeasure: "Unit",
          brand: "ABB",
          manufacturer: "ABB Ltd",
          defaultSupplierId: supplier1.id,
          minimumStockLevel: 3,
          createdBy: adminOnk.id,
        },
      ])
      .returning();

    // Link materials to suppliers
    await db.insert(schema.materialSuppliers).values([
      { materialId: material1.id, supplierId: supplier1.id },
      { materialId: material2.id, supplierId: supplier2.id },
      { materialId: material3.id, supplierId: supplier3.id },
      { materialId: material4.id, supplierId: supplier1.id },
    ]);

    // Create price history
    await db.insert(schema.priceHistory).values([
      {
        materialId: material1.id,
        supplierId: supplier1.id,
        unitPrice: "25.50",
        currency: "USD",
        availabilityStatus: "In Stock",
        warrantyNotes: "2 years warranty",
        leadTime: 7,
        remarks: "Standard delivery",
        createdBy: adminOnk.id,
      },
      {
        materialId: material2.id,
        supplierId: supplier2.id,
        unitPrice: "450.00",
        currency: "USD",
        availabilityStatus: "In Stock",
        warrantyNotes: "1 year warranty",
        leadTime: 14,
        remarks: "Order in advance",
        createdBy: adminOnk.id,
      },
      {
        materialId: material3.id,
        supplierId: supplier3.id,
        unitPrice: "3.20",
        currency: "USD",
        availabilityStatus: "In Stock",
        warrantyNotes: "N/A",
        leadTime: 5,
        remarks: "Bulk pricing available",
        createdBy: adminOnk.id,
      },
      {
        materialId: material4.id,
        supplierId: supplier1.id,
        unitPrice: "125.00",
        currency: "USD",
        availabilityStatus: "In Stock",
        warrantyNotes: "1 year warranty",
        leadTime: 10,
        remarks: "Quick delivery available",
        createdBy: adminOnk.id,
      },
    ]);

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

seed()
  .then(() => {
    console.log("Seeding completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
