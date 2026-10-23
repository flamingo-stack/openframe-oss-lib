package com.openframe.test.data.dto.apikey;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Request body for {@code PUT /api/api-keys/{keyId}}. Mirrors {@code com.openframe.api.dto.UpdateApiKeyRequest}.
 *
 * <p>A partial update: the service applies only the fields that are non-null, so an omitted field keeps
 * its stored value. Null fields are therefore left out of the JSON.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UpdateApiKeyRequest {

    private String name;

    private String description;

    private Boolean enabled;

    private Instant expiresAt;
}
