import bcrypt from "bcrypt";
import { throwDeprecation } from "process";

export const hashedRefreshToken = async (token: string) => {
    try {
        const refreshToken = await bcrypt.hash(token, 10);
        return refreshToken;
    } catch (error) {
        throw new Error("There was some error hashing Refresh Token."); 
    }
}


export const compareRefreshToken = async (token: string, storedToken: string) => {
    try {
        const compareToken = await bcrypt.compare(token, storedToken);
        return compareToken;
    } catch (error) {
        throw new Error("There was some error verifying Refresh Token.")  
    }
}