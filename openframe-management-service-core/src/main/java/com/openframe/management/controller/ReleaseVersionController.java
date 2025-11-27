package com.openframe.management.controller;

import com.openframe.management.service.ReleaseVersionService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;

@Slf4j
@RestController
@RequestMapping("/v1/release-version")
@RequiredArgsConstructor
public class ReleaseVersionController {

    private final ReleaseVersionService releaseVersionService;

    @Data
    public static class ReleaseVersionRequest {
        private String releaseVersion;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> updateReleaseVersion(@RequestBody ReleaseVersionRequest request) {
        try {
            log.info("Received release version update request: {}", request.getReleaseVersion());
            var savedVersion = releaseVersionService.processReleaseVersion(request.getReleaseVersion());
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Release version processed successfully",
                "releaseVersion", savedVersion.getVersion(),
                "id", savedVersion.getId(),
                "createdAt", savedVersion.getCreatedAt() != null ? savedVersion.getCreatedAt().toString() : null,
                "updatedAt", savedVersion.getUpdatedAt() != null ? savedVersion.getUpdatedAt().toString() : null
            ));
        } catch (Exception e) {
            log.error("Failed to process release version: {}", request.getReleaseVersion(), e);
            return ResponseEntity.status(INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}

