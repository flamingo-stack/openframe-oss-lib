package com.openframe.management.systemscript;

import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

/**
 * Ensures every tenant carries the package-manager bootstrap scripts: seeds
 * them on startup and re-seeds a script whose stored contentHash no longer
 * matches the shipped body. Startup (not the tenant-registration event) is the
 * seeding point on purpose — it also covers tenants that existed before this
 * feature and future body upgrades, and it runs inside the tenant's own data
 * context.
 */
@Component
@Order(25)
@RequiredArgsConstructor
@Slf4j
public class SystemScriptInitializer implements ApplicationRunner {

    private final ScriptRepository scriptRepository;
    private final TenantIdProvider tenantIdProvider;

    @Override
    public void run(ApplicationArguments args) {
        String tenantId = tenantIdProvider.getTenantId();
        for (SystemScriptDefinition definition : SystemScriptDefinition.values()) {
            ensure(tenantId, definition);
        }
        log.info("System script definitions ensured for tenant {}", tenantId);
    }

    private void ensure(String tenantId, SystemScriptDefinition definition) {
        String body = loadBody(definition);
        String contentHash = sha256(body);

        scriptRepository.findSystemScript(definition.getCode(), tenantId)
                .ifPresentOrElse(
                        script -> refreshIfStale(script, definition, body, contentHash),
                        () -> create(tenantId, definition, body, contentHash));
    }

    private void refreshIfStale(Script script, SystemScriptDefinition definition, String body, String contentHash) {
        if (contentHash.equals(script.getContentHash())) {
            return;
        }
        refresh(script, definition, body, contentHash);
    }

    private void create(String tenantId, SystemScriptDefinition definition, String body, String contentHash) {
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

    private void refresh(Script script, SystemScriptDefinition definition, String body, String contentHash) {
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
