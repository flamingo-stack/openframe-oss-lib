package com.openframe.sdk.fleetmdm.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OsquerySchemaSearchRequest {

    private String query;
    private String platform;
    private Integer limit;
}
