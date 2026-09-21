package com.openframe.data.document.tool;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DebeziumConnector {
    private String name;
    private String connectorClass;
    private String config;
}
