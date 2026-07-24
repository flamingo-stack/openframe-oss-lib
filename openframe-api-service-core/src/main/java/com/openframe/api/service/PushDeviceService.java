package com.openframe.api.service;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.push.PushPlatform;
import com.openframe.data.repository.push.PushDeviceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Service
@RequiredArgsConstructor
public class PushDeviceService {

    private final PushDeviceRepository deviceRepository;

    public boolean register(String userId, String token, PushPlatform platform) {
        if (isBlank(token)) {
            throw new BadRequestException("token must not be blank");
        }
        if (platform == null) {
            throw new BadRequestException("platform is required");
        }
        return deviceRepository.registerToken(userId, token, platform);
    }

    public boolean unregister(String userId, String token) {
        if (isBlank(token)) {
            throw new BadRequestException("token must not be blank");
        }
        return deviceRepository.deleteByUserIdAndToken(userId, token) > 0;
    }
}
