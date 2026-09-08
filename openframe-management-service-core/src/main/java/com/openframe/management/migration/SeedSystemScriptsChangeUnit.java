package com.openframe.management.migration;

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

@Slf4j
@ChangeUnit(id = "seed-system-scripts", order = "013", author = "openframe")
public class SeedSystemScriptsChangeUnit {

    @Execution
    public void execution(ScriptRepository scriptRepository, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        for (SystemScriptDefinition definition : SystemScriptDefinition.values()) {
            seedIfAbsent(scriptRepository, tenantId, definition);
        }
        log.info("System scripts seeded for tenant {}", tenantId);
    }

    @RollbackExecution
    public void rollback() {
    }

    private void seedIfAbsent(ScriptRepository scriptRepository, String tenantId, SystemScriptDefinition definition) {
        scriptRepository.findSystemScript(definition.getCode(), tenantId)
                .ifPresentOrElse(
                        script -> log.debug("System script {} already present for tenant {}", script.getName(), tenantId),
                        () -> create(scriptRepository, tenantId, definition));
    }

    private void create(ScriptRepository scriptRepository, String tenantId, SystemScriptDefinition definition) {
        String canonicalName = definition.getCode().canonicalName();
        String body = loadBody(definition);
        Script script = Script.builder()
                .tenantId(tenantId)
                .name(canonicalName)
                .description(definition.getDescription())
                .shell(definition.getShell())
                .privilegeLevel(definition.getPrivilegeLevel())
                .defaultTimeoutSeconds(definition.getDefaultTimeoutSeconds())
                .scriptBody(body)
                .supportedPlatforms(List.of(definition.getOsType()))
                .system(true)
                .contentHash(sha256(body))
                .build();
        Script saved = scriptRepository.save(script);
        log.info("Seeded system script {} id={}", canonicalName, saved.getId());
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
