package com.openframe.api.dto.organization;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for address information.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddressDto {
    private String street1;
    private String street2;
    private String city;
    private String state;
    private String postalCode;
    private String country;
}
