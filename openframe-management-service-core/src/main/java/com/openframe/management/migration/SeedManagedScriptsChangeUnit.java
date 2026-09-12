package com.openframe.management.migration;

import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.management.systemscript.ManagedScriptDefinition;
import com.openframe.management.systemscript.SoftwareScriptDefinition;
import com.openframe.management.systemscript.SystemScriptDefinition;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;

@Slf4j
@ChangeUnit(id = "seed-system-scripts", order = "013", author = "openframe", runAlways = true)
public class SeedManagedScriptsChangeUnit {

    private static List<ManagedScriptDefinition> definitions() {
        List<ManagedScriptDefinition> all = new ArrayList<>();
        all.addAll(Arrays.asList(SystemScriptDefinition.values()));
        all.addAll(Arrays.asList(SoftwareScriptDefinition.values()));
        return all;
    }

    @Execution
    public void execution(ScriptRepository scriptRepository, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        for (ManagedScriptDefinition definition : definitions()) {
            ensure(scriptRepository, tenantId, definition);
        }
        log.info("Managed script definitions ensured for tenant {}", tenantId);
    }

    @RollbackExecution
    public void rollback() {
        // seeded scripts are reconciled forward on every run — nothing to undo
    }

    private void ensure(ScriptRepository scriptRepository, String tenantId, ManagedScriptDefinition definition) {
        String body = loadBody(definition);
        String contentHash = sha256(body);

        scriptRepository.findByTenantIdAndNameAndType(tenantId, definition.getCanonicalName(), definition.getScriptType())
                .ifPresentOrElse(
                        script -> refreshIfStale(scriptRepository, script, definition, body, contentHash),
                        () -> create(scriptRepository, tenantId, definition, body, contentHash));
    }

    private void refreshIfStale(ScriptRepository scriptRepository, Script script,
                                ManagedScriptDefinition definition, String body, String contentHash) {
        if (contentHash.equals(script.getContentHash())) {
            return;
        }
        refresh(scriptRepository, script, definition, body, contentHash);
    }

    private void create(ScriptRepository scriptRepository, String tenantId,
                        ManagedScriptDefinition definition, String body, String contentHash) {
        String canonicalName = definition.getCanonicalName();
        Script script = Script.builder()
                .tenantId(tenantId)
                .name(canonicalName)
                .description(definition.getDescription())
                .shell(definition.getShell())
                .privilegeLevel(definition.getPrivilegeLevel())
                .defaultTimeoutSeconds(definition.getDefaultTimeoutSeconds())
                .scriptBody(body)
                .supportedPlatforms(List.of(definition.getOsType()))
                .type(definition.getScriptType())
                .contentHash(contentHash)
                .build();
        Script saved = scriptRepository.save(script);
        log.info("Seeded {} script {} id={}", definition.getScriptType(), canonicalName, saved.getId());
    }

    private void refresh(ScriptRepository scriptRepository, Script script,
                         ManagedScriptDefinition definition, String body, String contentHash) {
        script.setDescription(definition.getDescription());
        script.setShell(definition.getShell());
        script.setPrivilegeLevel(definition.getPrivilegeLevel());
        script.setDefaultTimeoutSeconds(definition.getDefaultTimeoutSeconds());
        script.setScriptBody(body);
        script.setSupportedPlatforms(List.of(definition.getOsType()));
        script.setType(definition.getScriptType());
        script.setContentHash(contentHash);
        scriptRepository.save(script);
        log.info("Refreshed {} script {} to contentHash={}", definition.getScriptType(), script.getName(), contentHash);
    }

    private static String loadBody(ManagedScriptDefinition definition) {
        ClassPathResource resource = new ClassPathResource(definition.getResourcePath());
        try (InputStream in = resource.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("cannot load managed script body: " + definition.getResourcePath(), e);
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
