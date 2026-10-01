package com.openframe.test.data.dto.shared;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// A coded userErrors entry of the SaaS api schema (code, message, optional field), unlike the field-path MutationError.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class UserError {
    private String code;
    private String message;
    private String field;
}
