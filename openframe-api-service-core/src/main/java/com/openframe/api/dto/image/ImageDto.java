package com.openframe.api.dto.image;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ImageDto {

    private String imageUrl;
    private String hash;

}
