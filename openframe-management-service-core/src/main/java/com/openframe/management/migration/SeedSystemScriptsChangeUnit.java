package com.openframe.management.migration;

import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.management.systemscript.SystemScriptDefinition;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

/**
 * Ensures the package-manager bootstrap scripts exist for the tenant: seeds a
 * missing script and re-seeds one whose stored contentHash no longer matches
 * the shipped body. {@code runAlways} on purpose — the bodies ship with the
 * lib, so every release with a changed body reconciles on next startup, and
 * Mongock's lock serializes concurrent replicas.
 */
@Slf4j
@ChangeUnit(id = "seed-system-scripts", order = "012", author = "openframe", runAlways = true)
public class SeedSystemScriptsChangeUnit {

    @Execution
    public void execution(ScriptRepository scriptRepository, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        for (SystemScriptDefinition definition : SystemScriptDefinition.values()) {
            ensure(scriptRepository, tenantId, definition);
        }
        log.info("System script definitions ensured for tenant {}", tenantId);
    }

    @RollbackExecution
    public void rollback() {
        // seeded scripts are reconciled forward on every run — nothing to undo
    }

    private void ensure(ScriptRepository scriptRepository, String tenantId, SystemScriptDefinition definition) {
        String body = loadBody(definition);
        String contentHash = sha256(body);

        scriptRepository.findSystemScript(definition.getCode(), tenantId)
                .ifPresentOrElse(
                        script -> refreshIfStale(scriptRepository, script, definition, body, contentHash),
                        () -> create(scriptRepository, tenantId, definition, body, contentHash));
    }

    private void refreshIfStale(ScriptRepository scriptRepository, Script script,
                                SystemScriptDefinition definition, String body, String contentHash) {
        if (contentHash.equals(script.getContentHash())) {
            return;
        }
        refresh(scriptRepository, script, definition, body, contentHash);
    }

    private void create(ScriptRepository scriptRepository, String tenantId,
                        SystemScriptDefinition definition, String body, String contentHash) {
        String canonicalName = definition.getCode().canonicalName();
        Script script = Script.builder()
                .tenantId(tenantId)
                .name(canonicalName)
                .description(definition.getDescription())
                .shell(definition.getShell())
                .privilegeLevel(PrivilegeLevel.ADMIN)
                .scriptBody(body)
                .supportedPlatforms(List.of(definition.getOsType()))
                .system(true)
                .contentHash(contentHash)
                .build();
        Script saved = scriptRepository.save(script);
        log.info("Seeded system script {} id={}", canonicalName, saved.getId());
    }

    private void refresh(ScriptRepository scriptRepository, Script script,
                         SystemScriptDefinition definition, String body, String contentHash) {
        script.setDescription(definition.getDescription());
        script.setShell(definition.getShell());
        script.setPrivilegeLevel(PrivilegeLevel.ADMIN);
        script.setScriptBody(body);
        script.setSupportedPlatforms(List.of(definition.getOsType()));
        script.setContentHash(contentHash);
        scriptRepository.save(script);
        log.info("Refreshed system script {} to contentHash={}", script.getName(), contentHash);
    }

    private static String loadBody(SystemScriptDefinition definition) {
        ClassPathResource resource = new ClassPathResource(definition.getResourcePath());
        try (InputStream in = resource.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("cannot load system script body: " + definition.getResourcePath(), e);
        }
    }

    private static String sha256(String body) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(body.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
