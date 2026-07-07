package com.openframe.data.document.rmm;
import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;
/**
 * Script document representing a reusable RMM script that can be executed
 * on agents either ad-hoc, on a schedule, or as part of a check.
 *
 * <p>Scripts are tenant-scoped: name uniqueness is enforced per tenant via the
 * compound index. The script body itself, along with default execution
 * parameters (timeout, args, env vars), is stored on the document so that the
 * agent can receive a self-contained payload at execution time.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "scripts")
// Non-unique tenant-scoped lookup index. The actual name-uniqueness
// constraint lives in MongoIndexConfig as a PARTIAL unique index scoped to
// {status: {$in: [ACTIVE, ARCHIVED]}} — soft-deleted names free up for reuse.
@CompoundIndex(
        def = "{'tenantId': 1, 'name': 1}"
)
public class Script implements TenantScoped {
    @Id
    private String id;
    /**
     * Tenant that owns this script. All queries must be scoped by this field
     * to enforce multi-tenant isolation.
     */
    private String tenantId;
    /**
     * Human-readable script name. Must be unique within the tenant (enforced
     * by the compound index on {@code (tenantId, name)}).
     */
    private String name;
    /**
     * Optional free-form description shown in the admin UI.
     */
    private String description;
    /**
     * Shell interpreter to use on the agent (PowerShell, CMD, Bash, Python).
     */
    private ScriptShell shell;
    /**
     * Privilege the script runs as on the agent (USER / ADMIN). Chosen by the
     * author at creation time and surfaced on read so runs default to it.
     */
    private PrivilegeLevel privilegeLevel;
    /**
     * Raw script source code that the agent will execute via the configured
     * {@link #shell}. Stored inline regardless of size for now; a future
     * iteration may offload large bodies to object storage.
     */
    private String scriptBody;
    /**
     * Operating systems the script supports. Used by the UI/service layer to
     * prevent dispatching a Windows-only script to a Linux agent.
     */
    private List<ScriptPlatform> supportedPlatforms;
    /**
     * Default execution timeout in seconds. The agent will forcibly kill the
     * process if this is exceeded. May be overridden per execution request.
     */
    private Integer defaultTimeoutSeconds;
    /**
     * Default positional command-line arguments passed to the script
     * (analogous to {@code argv}). May be overridden per execution request.
     */
    private List<String> defaultArgs;
    /**
     * Default environment variables exported on the agent before script
     * execution. Variables flagged as {@code secret} require encryption at
     * rest and secure delivery to the agent; that pipeline is not yet
     * implemented — see follow-up secret-management story.
     */
    private List<ScriptEnvVar> envVars;
    /**
     * Id of the user who created the script (the {@code sub} claim at creation).
     * Surfaced on read via the GraphQL {@code author} field, resolved to a User.
     */
    private String createdBy;
    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;
    /**
     * Lifecycle status. Defaults to {@link ScriptStatus#ACTIVE}. {@code DELETED}
     * is used as a soft-delete so that historic execution records continue to
     * reference a valid script document.
     */
    @Indexed
    @Builder.Default
    private ScriptStatus status = ScriptStatus.ACTIVE;
    /**
     * Timestamp of the most recent {@link #status} transition.
     */
    private Instant statusChangedAt;
}
