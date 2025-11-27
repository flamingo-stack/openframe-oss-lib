package com.openframe.api.controller;

import com.openframe.api.dto.ClusterRegistrationResponse;
import com.openframe.api.service.ClusterRegistrationQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/cluster-registrations")
@RequiredArgsConstructor
public class ClusterRegistrationController {

    private final ClusterRegistrationQueryService clusterRegistrationQueryService;

    @GetMapping
    public ResponseEntity<ClusterRegistrationResponse> getClusterRegistration() {
        log.info("Received get cluster registration request");
        
        return clusterRegistrationQueryService.getClusterRegistration()
                .map(registration -> ResponseEntity.ok(
                        new ClusterRegistrationResponse(
                                registration.getId(),
                                registration.getImageTagVersion(),
                                registration.getCreatedAt(),
                                registration.getUpdatedAt()
                        )
                ))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }
}

