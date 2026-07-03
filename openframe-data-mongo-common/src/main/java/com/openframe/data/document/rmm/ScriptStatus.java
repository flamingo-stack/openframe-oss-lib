package com.openframe.data.document.rmm;
/**
 * Lifecycle status of a {@link Script}.
 *
 * <p>Mirrors the {@code OrganizationStatus} pattern used elsewhere in the
 * data model. {@code DELETED} is a soft-delete: the document stays in MongoDB
 * so historic execution records continue to reference a valid script, but
 * the script is hidden from default list / get / update API surfaces.
 *
 * <p>Name uniqueness is enforced by a PARTIAL unique index on
 * {@code (tenantId, name)} filtered by {@code status != DELETED} (see
 * {@code MongoIndexConfig}). Soft-deleted names are therefore free for reuse
 * — matches the user-facing model "if I deleted it, it's gone". The
 * document itself stays in Mongo so historic execution rows keep resolving
 * the script's display name.
 */
public enum ScriptStatus {
    ACTIVE,
    ARCHIVED,
    DELETED
}
