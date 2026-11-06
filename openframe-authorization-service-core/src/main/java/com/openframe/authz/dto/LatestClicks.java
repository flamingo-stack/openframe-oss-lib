package com.openframe.authz.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LatestClicks {

    private AdClickDto meta;
    private AdClickDto google;
    private AdClickDto reddit;
    private AdClickDto linkedin;
}
