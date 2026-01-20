/**
 * Schema Migration System for UI Design Documents
 *
 * This module provides versioning and automatic migration for .uidesign files.
 * Migrations preserve unknown fields and ensure backwards compatibility.
 */

import { UIDocument, UINode, Screen } from "../types/ui-schema";

/**
 * Current schema version - all new documents should use this version
 */
export const CURRENT_SCHEMA_VERSION = "1.1";

/**
 * Minimum supported schema version
 */
export const MIN_SCHEMA_VERSION = "1.0";

/**
 * Migration function type
 * Takes a document and returns an upgraded document
 * Should preserve unknown fields by spreading the original object
 */
export type MigrationFn = (doc: UIDocument) => UIDocument;

/**
 * Migration definition
 */
export interface Migration {
  fromVersion: string;
  toVersion: string;
  description: string;
  migrate: MigrationFn;
}

/**
 * Result of a migration attempt
 */
export interface MigrationResult {
  success: boolean;
  document: UIDocument;
  migrationsApplied: string[];
  errors: string[];
  originalVersion: string;
  finalVersion: string;
}

/**
 * Parse a version string into comparable parts
 * Supports versions like "1.0", "1.1", "2.0"
 */
function parseVersion(version: string): { major: number; minor: number } {
  const parts = version.split(".").map(Number);
  return {
    major: parts[0] || 1,
    minor: parts[1] || 0,
  };
}

/**
 * Compare two version strings
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const vA = parseVersion(a);
  const vB = parseVersion(b);

  if (vA.major !== vB.major) {
    return vA.major < vB.major ? -1 : 1;
  }
  if (vA.minor !== vB.minor) {
    return vA.minor < vB.minor ? -1 : 1;
  }
  return 0;
}

/**
 * Registry of all migrations
 * Migrations are applied in order based on version
 */
const migrations: Migration[] = [];

/**
 * Register a migration
 */
export function registerMigration(migration: Migration): void {
  migrations.push(migration);
  // Keep migrations sorted by fromVersion
  migrations.sort((a, b) => compareVersions(a.fromVersion, b.fromVersion));
}

/**
 * Get the inferred schema version from a document
 * If schemaVersion is not present, we infer it as "1.0"
 */
export function getDocumentVersion(doc: Partial<UIDocument>): string {
  if (doc.schemaVersion) {
    return doc.schemaVersion;
  }
  // Documents without schemaVersion are treated as v1.0
  return "1.0";
}

/**
 * Check if a document needs migration
 */
export function needsMigration(doc: Partial<UIDocument>): boolean {
  const version = getDocumentVersion(doc);
  return compareVersions(version, CURRENT_SCHEMA_VERSION) < 0;
}

/**
 * Get applicable migrations for upgrading from one version to another
 */
function getApplicableMigrations(
  fromVersion: string,
  toVersion: string
): Migration[] {
  return migrations.filter((m) => {
    return (
      compareVersions(m.fromVersion, fromVersion) >= 0 &&
      compareVersions(m.toVersion, toVersion) <= 0
    );
  });
}

/**
 * Deep clone an object while preserving unknown fields
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }
  const cloned: Record<string, unknown> = {};
  for (const key of Object.keys(obj as object)) {
    cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
  }
  return cloned as T;
}

/**
 * Migrate a document to the current schema version
 * Preserves unknown fields and applies migrations incrementally
 */
export function migrateDocument(
  doc: Partial<UIDocument>
): MigrationResult {
  const originalVersion = getDocumentVersion(doc);
  const migrationsApplied: string[] = [];
  const errors: string[] = [];

  // Deep clone to avoid mutating the original
  let document = deepClone(doc) as UIDocument;

  // Ensure schemaVersion is set
  if (!document.schemaVersion) {
    document.schemaVersion = originalVersion;
  }

  // Check if migration is needed
  if (!needsMigration(document)) {
    return {
      success: true,
      document,
      migrationsApplied: [],
      errors: [],
      originalVersion,
      finalVersion: document.schemaVersion,
    };
  }

  // Get and apply applicable migrations
  const applicableMigrations = getApplicableMigrations(
    originalVersion,
    CURRENT_SCHEMA_VERSION
  );

  for (const migration of applicableMigrations) {
    try {
      // Only apply if document version matches migration source version
      if (compareVersions(document.schemaVersion, migration.fromVersion) === 0) {
        document = migration.migrate(document);
        document.schemaVersion = migration.toVersion;
        migrationsApplied.push(
          `${migration.fromVersion} -> ${migration.toVersion}: ${migration.description}`
        );
      }
    } catch (error) {
      errors.push(
        `Migration ${migration.fromVersion} -> ${migration.toVersion} failed: ${error}`
      );
    }
  }

  return {
    success: errors.length === 0,
    document,
    migrationsApplied,
    errors,
    originalVersion,
    finalVersion: document.schemaVersion,
  };
}

/**
 * Validate that a document has required fields for the current schema
 */
export function validateDocument(doc: Partial<UIDocument>): string[] {
  const errors: string[] = [];

  if (!doc.tokens || typeof doc.tokens !== "object") {
    errors.push("Missing or invalid 'tokens' field");
  }

  if (!doc.components || typeof doc.components !== "object") {
    errors.push("Missing or invalid 'components' field");
  }

  if (!doc.screens || typeof doc.screens !== "object") {
    errors.push("Missing or invalid 'screens' field");
  }

  return errors;
}

// =============================================================================
// MIGRATION DEFINITIONS
// =============================================================================

/**
 * Helper to recursively process nodes in a document
 */
function processNodesRecursively(
  node: UINode,
  processor: (node: UINode) => UINode
): UINode {
  const processed = processor(node);
  if (processed.children) {
    processed.children = processed.children.map((child) =>
      processNodesRecursively(child, processor)
    );
  }
  return processed;
}

/**
 * Helper to process all nodes in all screens of a document
 */
function processAllNodes(
  doc: UIDocument,
  processor: (node: UINode) => UINode
): UIDocument {
  const newScreens: { [id: string]: Screen } = {};

  for (const [screenId, screen] of Object.entries(doc.screens)) {
    newScreens[screenId] = {
      ...screen,
      root: processNodesRecursively(screen.root, processor),
    };
  }

  return {
    ...doc,
    screens: newScreens,
  };
}

/**
 * Migration: v1.0 -> v1.1
 *
 * Changes:
 * - Makes anchored layout optional (no layout changes needed, just version bump)
 * - Adds explicit schemaVersion field
 * - Preserves all existing fields
 *
 * This migration primarily ensures documents have the schemaVersion field
 * and validates their structure. The anchored layout mode was already optional
 * in practice, but this version formalizes that nodes can use any layout mode.
 */
registerMigration({
  fromVersion: "1.0",
  toVersion: "1.1",
  description: "Add schemaVersion field and formalize optional anchored layout",
  migrate: (doc: UIDocument): UIDocument => {
    // Process all nodes to ensure layout is valid
    // This migration doesn't change layouts, but validates them
    const migrated = processAllNodes(doc, (node: UINode): UINode => {
      // Preserve the node as-is, including any unknown fields
      // The layout field is required, but the specific mode is flexible
      if (!node.layout) {
        // If a node somehow lacks a layout (shouldn't happen), add a default
        return {
          ...node,
          layout: {
            mode: "absolute",
            x: 0,
            y: 0,
            w: 100,
            h: 100,
          },
        };
      }
      return node;
    });

    return {
      ...migrated,
      schemaVersion: "1.1",
    };
  },
});

// =============================================================================
// EXPORTS FOR EXTERNAL USE
// =============================================================================

export {
  compareVersions,
  parseVersion,
  processAllNodes,
  processNodesRecursively,
};
