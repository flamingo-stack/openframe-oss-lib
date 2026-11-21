package com.openframe.api.controller;

import com.openframe.api.dto.ApiKeyResponse;
import com.openframe.api.dto.CreateApiKeyRequest;
import com.openframe.api.dto.CreateApiKeyResponse;
import com.openframe.api.dto.UpdateApiKeyRequest;
import com.openframe.api.service.ApiKeyService;
import com.openframe.audit.Audited;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.openframe.data.document.audit.AuditAction.API_KEY_CREATE;
import static com.openframe.data.document.audit.AuditAction.API_KEY_DELETE;
import static com.openframe.data.document.audit.AuditAction.API_KEY_ROTATE;
import static com.openframe.data.document.audit.AuditAction.API_KEY_UPDATE;

@Slf4j
@RestController
@RequestMapping("/api-keys")
@RequiredArgsConstructor
public class ApiKeyController {

    private final ApiKeyService apiKeyService;

    @GetMapping
    public List<ApiKeyResponse> getApiKeys(@AuthenticationPrincipal AuthPrincipal principal) {
        log.debug("Fetching API keys for user: {}", principal.getId());
        return apiKeyService.getApiKeysForUser(principal.getId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Audited(action = API_KEY_CREATE, targetId = "#result.apiKey.id")
    public CreateApiKeyResponse createApiKey(
            @Valid @RequestBody CreateApiKeyRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        log.debug("Creating API key '{}' for user: {}", request.name(), principal.getId());
        return apiKeyService.createApiKey(principal.getId(), request);
    }

    @GetMapping("/{keyId}")
    public ApiKeyResponse getApiKey(
            @PathVariable String keyId,
            @AuthenticationPrincipal AuthPrincipal principal) {
        log.debug("Fetching API key {} for user: {}", keyId, principal.getId());
        return apiKeyService.getApiKeyById(keyId, principal.getId());
    }

    @PutMapping("/{keyId}")
    @Audited(action = API_KEY_UPDATE, targetId = "#keyId")
    public ApiKeyResponse updateApiKey(
            @PathVariable String keyId,
            @Valid @RequestBody UpdateApiKeyRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        log.debug("Updating API key {} for user: {}", keyId, principal.getId());
        return apiKeyService.updateApiKey(keyId, principal.getId(), request);
    }

    @DeleteMapping("/{keyId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Audited(action = API_KEY_DELETE, targetId = "#keyId")
    public void deleteApiKey(
            @PathVariable String keyId,
            @AuthenticationPrincipal AuthPrincipal principal) {
        log.debug("Deleting API key {} for user: {}", keyId, principal.getId());
        apiKeyService.deleteApiKey(keyId, principal.getId());
    }

    @PostMapping("/{keyId}/regenerate")
    @Audited(action = API_KEY_ROTATE, targetId = "#keyId", details = "newKeyId=#result.apiKey.id")
    public CreateApiKeyResponse regenerateApiKey(
            @PathVariable String keyId,
            @AuthenticationPrincipal AuthPrincipal principal) {
        log.debug("Regenerating API key {} for user: {}", keyId, principal.getId());
        return apiKeyService.regenerateApiKey(keyId, principal.getId());
    }
} 