package com.openframe.authz.keys;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@Getter
@Setter
@ConfigurationProperties(prefix = "openframe.authz.key-generator")
public class KeyGeneratorProperties {

    private String algorithm = "RSA";
    private int keySize = 2048;
    private String secureRandomAlgorithm = "NativePRNGNonBlocking";
}
