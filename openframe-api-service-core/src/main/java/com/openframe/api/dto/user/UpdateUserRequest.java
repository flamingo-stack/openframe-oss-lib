package com.openframe.api.dto.user;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateUserRequest {
    @Size(max = 128)
    private String firstName;

    @Size(max = 128)
    private String lastName;
}

