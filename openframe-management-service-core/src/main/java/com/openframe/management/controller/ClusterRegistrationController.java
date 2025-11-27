package com.openframe.management.controller;

import com.openframe.management.service.ClusterRegistrationService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;

@Slf4j
@RestController
@RequestMapping("/v1/cluster-registrations")
@RequiredArgsConstructor
public class ClusterRegistrationController {

    private final ClusterRegistrationService clusterRegistrationService;

    @Data
    public static class ClusterRegistrationRequest {
        private String imageTagVersion;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> updateClusterRegistration(@RequestBody ClusterRegistrationRequest request) {
        try {
            log.info("Received cluster registration update request: {}", request.getImageTagVersion());
            var saved = clusterRegistrationService.processClusterRegistration(request.getImageTagVersion());
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Cluster registration processed successfully",
                "imageTagVersion", saved.getImageTagVersion(),
                "id", saved.getId(),
                "createdAt", saved.getCreatedAt() != null ? saved.getCreatedAt().toString() : null,
                "updatedAt", saved.getUpdatedAt() != null ? saved.getUpdatedAt().toString() : null
            ));
        } catch (Exception e) {
            log.error("Failed to process cluster registration: {}", request.getImageTagVersion(), e);
            return ResponseEntity.status(INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}

