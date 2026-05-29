package com.openframe.data.document.rmm;

/**
 * Lifecycle status of a {@link Script}.
 *
 * <p>Mirrors the {@code OrganizationStatus} pattern used elsewhere in the
 * data model. {@code DELETED} is a soft-delete: the document stays in MongoDB
 * so historic execution records continue to reference a valid script, but
 * the script is hidden from default list / get / update API surfaces.
 *
 * <p>Because the compound unique index on {@code (tenantId, name)} includes
 * {@code DELETED} documents, a soft-deleted name remains occupied. To reuse
 * a name, the document must be hard-deleted (admin tooling).
 */
public enum ScriptStatus {
    ACTIVE,
    ARCHIVED,
    DELETED
}
