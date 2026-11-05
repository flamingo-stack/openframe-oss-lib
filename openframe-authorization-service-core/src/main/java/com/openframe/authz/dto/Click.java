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
public class Click {

    private String fbclid;
    private String gclid;
    private String rdtCid;
    private String liFatId;
    private Long clickedAt;

    public int totalLength() {
        return Stream.of(fbclid, gclid, rdtCid, liFatId, Objects.toString(clickedAt, null))
                .filter(Objects::nonNull)
                .mapToInt(String::length)
                .sum();
    }
}
