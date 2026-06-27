package com.openframe.api.dto.script;

import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptShell;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;

/**
 * Input payload for fully replacing an existing script (PUT semantics): every
 * writable field on the input overwrites the corresponding field on the stored
 * document, including {@code null}s which clear the field. Callers must send
 * the full resource on every update — partial updates are not supported.
 *
 * <p>Domain-required fields ({@link #name}, {@link #shell}, {@link #scriptBody})
 * mirror their constraints on {@link CreateScriptInput} — a script without a
 * name, shell, or body would be meaningless, so the update endpoint refuses
 * to put the document into that state.
 *
 * <p>Truly optional fields ({@link #description},
 * {@link #supportedPlatforms}, {@link #defaultTimeoutSeconds},
 * {@link #defaultArgs}, {@link #envVars}) accept {@code null} and the mapper
 * will clear the stored value.
 */
@Data
public class UpdateScriptInput {

    @NotBlank
    private String id;

    @NotBlank
    private String name;

    private String description;

    @NotNull
    private ScriptShell shell;

    @NotNull
    private PrivilegeLevel privilegeLevel;

    @NotBlank
    private String scriptBody;

    private List<ScriptPlatform> supportedPlatforms;

    @Positive
    @Max(value = 600, message = "defaultTimeoutSeconds must not exceed 600 (10 minutes)")
    private Integer defaultTimeoutSeconds;

    private List<String> defaultArgs;

    @Valid
    private List<ScriptEnvVarInput> envVars;

    /** Ids of existing {@code Tag} entities to assign (replaces the current set). */
    private List<String> tagIds;
}
