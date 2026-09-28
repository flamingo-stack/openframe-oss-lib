package com.openframe.test.data.dto.apikey;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Request body for {@code POST /api/api-keys}.
 *
 * <p>Mirrors {@code com.openframe.api.dto.CreateApiKeyRequest}. Only {@code name} is meaningful for the
 * suite; {@code expiresAt} is left unset because the key is deleted at the end of the run rather than
 * left to expire.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateApiKeyRequest {

    private String name;

    private String description;

    private Instant expiresAt;
}
