// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { ApplicationTokenCredentials } from "./applicationTokenCredentials";
import { DeviceTokenCredentials } from "./deviceTokenCredentials";
import { MSIAppServiceTokenCredentials } from "./msiAppServiceTokenCredentials";
import { MSITokenCredentials } from "./msiTokenCredentials";
import { MSIVmTokenCredentials } from "./msiVmTokenCredentials";
import { TokenCredentialsBase } from "./tokenCredentialsBase";
import { UserTokenCredentials } from "./userTokenCredentials";
import { AuthenticationContext, TokenResponse, ErrorResponse } from "adal-node";
import { Authenticator } from "ms-rest-js";

export function createAuthenticator(credentials: MSITokenCredentials): Authenticator {
  const convertedCredentials = _convert(credentials);
  const authenticator = _createAuthenticatorMapper(convertedCredentials);

  return authenticator;
}

function _convert(credentials: MSITokenCredentials): MSITokenCredentials {
  if (credentials instanceof MSIAppServiceTokenCredentials) {
    return new MSIAppServiceTokenCredentials({
      msiEndpoint: credentials.msiEndpoint,
      msiSecret: credentials.msiSecret,
      msiApiVersion: credentials.msiApiVersion,
      resource: credentials.resource
    });
  } else if (credentials instanceof MSIVmTokenCredentials) {
    return new MSIVmTokenCredentials({
      resource: credentials.resource,
      port: credentials.port
    });
  } else if (credentials instanceof MSITokenCredentials) {
    throw new Error("MSI-credentials not one of: MSIVmTokenCredentials, MSIAppServiceTokenCredentials");
  } else {
    return credentials;
  }
}

function _createAuthenticatorMapper(credentials: MSITokenCredentials): Authenticator {
  return function (challenge: any, callback: (error?: Error, authorizationValue?: string) => void) {
    // Function to take token Response and format a authorization value
    const _formAuthorizationValue = (err: Error, tokenResponse: TokenResponse | ErrorResponse) => {
      if (err) {
        return callback(err, undefined);
      }

      if (tokenResponse.error) {
        return callback(tokenResponse.error, undefined);
      }

      tokenResponse = tokenResponse as TokenResponse;
      // Calculate the value to be set in the request's Authorization header and resume the call.
      const authorizationValue = tokenResponse.tokenType + " " + tokenResponse.accessToken;
      return callback(undefined, authorizationValue);
    };

    // Create a new authentication context.
    if (credentials instanceof TokenCredentialsBase) {
      const context = new AuthenticationContext(challenge.authorization, true, credentials.authContext && credentials.authContext.cache);
      if (credentials instanceof ApplicationTokenCredentials) {
        return context.acquireTokenWithClientCredentials(
          challenge.resource, credentials.clientId, credentials.secret, _formAuthorizationValue);
      } else if (credentials instanceof UserTokenCredentials) {
        return context.acquireTokenWithUsernamePassword(
          challenge.resource, credentials.username, credentials.password, credentials.clientId, _formAuthorizationValue);
      } else if (credentials instanceof DeviceTokenCredentials) {
        return context.acquireToken(
          challenge.resource, credentials.username, credentials.clientId, _formAuthorizationValue);
      }
    } else if (credentials instanceof MSITokenCredentials) {
      return credentials.getToken();
    } else {
      callback(new Error("credentials must be one of: ApplicationTokenCredentials, UserTokenCredentials, " +
        "DeviceTokenCredentials, MSITokenCredentials"), undefined);
    }
  };
}