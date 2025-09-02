package com.openframe.oss.testlib;

import lombok.experimental.UtilityClass;
import lombok.extern.slf4j.Slf4j;

/**
 * Sample utility class for mathematical operations.
 * This is a demonstration library for the Maven release workflow.
 */
@Slf4j
@UtilityClass
public class MathUtils {

    /**
     * Calculates the factorial of a number.
     *
     * @param n the number to calculate factorial for
     * @return the factorial of n
     * @throws IllegalArgumentException if n is negative
     */
    public long factorial(int n) {
        if (n < 0) {
            throw new IllegalArgumentException("Factorial is not defined for negative numbers");
        }
        
        long result = 1;
        for (int i = 2; i <= n; i++) {
            result *= i;
        }
        
        log.debug("Factorial of {} is {}", n, result);
        return result;
    }

    /**
     * Checks if a number is prime.
     *
     * @param n the number to check
     * @return true if the number is prime, false otherwise
     */
    public boolean isPrime(int n) {
        if (n <= 1) {
            return false;
        }
        
        if (n <= 3) {
            return true;
        }
        
        if (n % 2 == 0 || n % 3 == 0) {
            return false;
        }
        
        for (int i = 5; i * i <= n; i += 6) {
            if (n % i == 0 || n % (i + 2) == 0) {
                log.debug("{} is not prime", n);
                return false;
            }
        }
        
        log.debug("{} is prime", n);
        return true;
    }

    /**
     * Calculates the greatest common divisor of two numbers.
     *
     * @param a first number
     * @param b second number
     * @return the GCD of a and b
     */
    public int gcd(int a, int b) {
        a = Math.abs(a);
        b = Math.abs(b);
        
        while (b != 0) {
            int temp = b;
            b = a % b;
            a = temp;
        }
        
        log.debug("GCD of {} and {} is {}", a, b, a);
        return a;
    }

    /**
     * Calculates the least common multiple of two numbers.
     *
     * @param a first number
     * @param b second number
     * @return the LCM of a and b
     */
    public int lcm(int a, int b) {
        if (a == 0 || b == 0) {
            return 0;
        }
        
        int result = Math.abs(a * b) / gcd(a, b);
        log.debug("LCM of {} and {} is {}", a, b, result);
        return result;
    }
}