package com.openframe.client.controller;

import com.openframe.client.service.validator.AgentRegistrationSecretValidator;
import com.openframe.data.repository.version.ReleaseVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/release-version")
@RequiredArgsConstructor
public class ReleaseVersionController {

    private final ReleaseVersionRepository releaseVersionRepository;
    private final AgentRegistrationSecretValidator secretValidator;

    @GetMapping(produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getReleaseVersion(@RequestHeader("X-Initial-Key") String initialKey) {
        secretValidator.validate(initialKey);

        return releaseVersionRepository.findFirstByOrderByCreatedAtAsc()
                .map(version -> ResponseEntity.ok(version.getVersion()))
                .orElse(ResponseEntity.notFound().build());
    }
}
