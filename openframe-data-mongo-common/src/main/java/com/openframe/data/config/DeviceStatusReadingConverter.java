package com.openframe.data.config;

import com.openframe.data.document.device.DeviceStatus;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;

@ReadingConverter
public enum DeviceStatusReadingConverter implements Converter<String, DeviceStatus> {
    INSTANCE;

    @Override
    public DeviceStatus convert(String source) {
        return DeviceStatus.fromStored(source);
    }
}
