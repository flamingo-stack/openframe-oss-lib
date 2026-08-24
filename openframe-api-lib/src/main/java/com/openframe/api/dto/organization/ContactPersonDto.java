package com.openframe.api.dto.organization;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * DTO for contact person information.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContactPersonDto {
    private String contactName;
    private String title;
    private String phone;
    private String email;
}
