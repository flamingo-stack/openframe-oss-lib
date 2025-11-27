package com.openframe.management.controller;

import com.openframe.management.service.VersionService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;

@Slf4j
@RestController
@RequestMapping("/v1/version")
@RequiredArgsConstructor
public class VersionController {

    private final VersionService versionService;

    @Data
    public static class VersionRequest {
        private String version;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> updateVersion(@RequestBody VersionRequest request) {
        try {
            log.info("Received version update request: {}", request.getVersion());
            var savedVersion = versionService.processVersion(request.getVersion());
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Version processed successfully",
                "version", request.getVersion(),
                "id", savedVersion.getId(),
                "createdAt", savedVersion.getCreatedAt() != null ? savedVersion.getCreatedAt().toString() : null
            ));
        } catch (Exception e) {
            log.error("Failed to process version: {}", request.getVersion(), e);
            return ResponseEntity.status(INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}

