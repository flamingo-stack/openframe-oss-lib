package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class OsUpdateRolloutStrategyResolver {

    private final Map<OsUpdateRolloutMode, OsUpdateRolloutStrategy> osUpdateRolloutStrategies;

    public OsUpdateRolloutStrategyResolver(List<OsUpdateRolloutStrategy> osUpdateRolloutStrategies) {
        this.osUpdateRolloutStrategies = osUpdateRolloutStrategies.stream()
                .collect(Collectors.toMap(OsUpdateRolloutStrategy::getMode, Function.identity()));
    }

    public OsUpdateRolloutStrategy resolve(OsUpdateRolloutMode osUpdateRolloutMode) {
        return osUpdateRolloutStrategies.get(osUpdateRolloutMode);
    }
}
