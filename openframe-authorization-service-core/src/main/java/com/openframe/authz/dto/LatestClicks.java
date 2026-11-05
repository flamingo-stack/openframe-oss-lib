package com.openframe.authz.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Objects;
import java.util.stream.Stream;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LatestClicks {

    private Click meta;
    private Click google;
    private Click reddit;
    private Click linkedin;

    public int totalLength() {
        return Stream.of(meta, google, reddit, linkedin)
                .filter(Objects::nonNull)
                .mapToInt(Click::totalLength)
                .sum();
    }
}
