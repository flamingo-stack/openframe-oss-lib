package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OsquerySchemaSearchResponse {

    private String query;
    private String platform;
    private Integer count;
    private List<OsqueryTableSchema> tables;
}
