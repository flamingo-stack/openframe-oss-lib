package com.openframe.audit.targets;

import com.openframe.data.document.audit.AuditTargetType;
import org.springframework.stereotype.Component;
import org.springframework.util.Assert;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class AuditTargetRegistry {

    private final Map<AuditTargetType, List<AuditTarget<?>>> targetsByType = new EnumMap<>(AuditTargetType.class);

    public AuditTargetRegistry(List<AuditTargetProvider> providers) {
        providers.stream()
                .map(AuditTargetProvider::targets)
                .flatMap(Collection::stream)
                .forEach(this::register);
    }

    public List<AuditTarget<?>> find(AuditTargetType type) {
        return targetsByType.getOrDefault(type, List.of());
    }

    private void register(AuditTarget<?> target) {
        List<AuditTarget<?>> targets = targetsByType.computeIfAbsent(target.type(), _ -> new ArrayList<>());
        Assert.state(targets.stream().noneMatch(known -> known.documentType() == target.documentType()),
                () -> "Two audit targets for " + target.type() + " and " + target.documentType().getSimpleName());
        targets.add(target);
    }
}
