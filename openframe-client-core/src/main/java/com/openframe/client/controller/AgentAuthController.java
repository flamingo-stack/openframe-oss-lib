package com.openframe.client.controller;

import com.openframe.client.dto.AgentTokenResponse;
import com.openframe.client.service.AgentAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/oauth")
@RequiredArgsConstructor
public class AgentAuthController {
    private final AgentAuthService agentAuthService;

    @PostMapping(value = "/token", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AgentTokenResponse> getClientToken(
            @RequestParam(name = "grant_type") String grantType,
            @RequestParam(name = "refresh_token", required = false) String refreshToken,
            @RequestParam(name = "client_id", required = false) String clientId,
            @RequestParam(name = "client_secret", required = false) String clientSecret) {

        log.debug("Client token request - client_id: {}", clientId);

        AgentTokenResponse response = agentAuthService.issueClientToken(grantType, refreshToken, clientId, clientSecret);
        return ResponseEntity.ok(response);
    }
}
