package com.openframe.api.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserInput {
    @NotBlank
    private String id;
    @Size(max = 128)
    private String firstName;
    @Size(max = 128)
    private String lastName;
}
