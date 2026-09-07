package com.openframe.stream.service;

import com.openframe.data.model.redis.CachedMachineInfo;
import org.springframework.stereotype.Component;

import static org.springframework.util.StringUtils.hasText;

@Component
public class MachineDisplayNameResolver {

    public String resolveDisplayName(CachedMachineInfo machine) {
        String nickname = machine.getNickname();
        if (hasText(nickname)) {
            return nickname;
        }
        return machine.getHostname();
    }
}
