package com.openframe.test.data.dto.user;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class User {
    /**
     * Set only on responses ({@code GET /api/me} via {@link com.openframe.test.api.UserApi#me()}); the
     * runner passes it to {@code openframe-client install --userId}. Field-level NON_NULL so the request
     * bodies this DTO is also used for (registration, login) stay byte-identical when it is unset.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private String id;
    private String email;
    private String password;
    private String domain;
}
