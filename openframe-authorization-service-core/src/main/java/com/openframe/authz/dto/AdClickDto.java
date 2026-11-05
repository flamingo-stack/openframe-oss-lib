package com.openframe.authz.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdClickDto {

    private String fbclid;
    private String gclid;
    private String rdtCid;
    private String liFatId;
    private Long clickedAt;
}
