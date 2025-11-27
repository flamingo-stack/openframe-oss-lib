package com.openframe.api.controller;

import com.openframe.api.dto.ReleaseVersionResponse;
import com.openframe.api.service.ReleaseVersionQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/release-version")
@RequiredArgsConstructor
public class ReleaseVersionController {

    private final ReleaseVersionQueryService releaseVersionQueryService;

    @GetMapping
    public ResponseEntity<ReleaseVersionResponse> getReleaseVersion() {
        log.info("Received get release version request");
        
        return releaseVersionQueryService.getReleaseVersion()
                .map(version -> ResponseEntity.ok(
                        new ReleaseVersionResponse(
                                version.getId(),
                                version.getVersion(),
                                version.getCreatedAt(),
                                version.getUpdatedAt()
                        )
                ))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }
}

