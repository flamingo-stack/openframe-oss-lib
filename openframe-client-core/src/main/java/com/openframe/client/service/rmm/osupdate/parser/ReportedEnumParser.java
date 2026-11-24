package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Locale;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReportedEnumParser {

    private final DeviceOsReportMetrics deviceOsReportMetrics;

    // null = the agent sent nothing, or a value this backend does not know yet. Never a failure: the agent ships
    // new values before the backend learns them.
    public <E extends Enum<E>> E parse(Class<E> enumType, String reportedValue) {
        if (isBlank(reportedValue)) {
            return null;
        }
        String constantName = reportedValue.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        try {
            return Enum.valueOf(enumType, constantName);
        } catch (IllegalArgumentException unknownValue) {
            log.debug("OS report names an unknown {}: {}", enumType.getSimpleName(), reportedValue);
            deviceOsReportMetrics.recordUnknownValue(enumType);
            return null;
        }
    }
}
