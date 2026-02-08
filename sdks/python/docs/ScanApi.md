# sipher_client.ScanApi

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**scan_assets**](ScanApi.md#scan_assets) | **POST** /v1/scan/assets | Scan stealth address assets via Helius DAS
[**scan_payments**](ScanApi.md#scan_payments) | **POST** /v1/scan/payments | Scan for incoming shielded payments
[**scan_payments_batch**](ScanApi.md#scan_payments_batch) | **POST** /v1/scan/payments/batch | Batch scan for payments across multiple key pairs


# **scan_assets**
> ScanAssets200Response scan_assets(scan_assets_request)

Scan stealth address assets via Helius DAS

Query all assets (SPL tokens, NFTs, cNFTs) at a stealth address using Helius DAS getAssetsByOwner API. Falls back to standard getTokenAccountsByOwner if Helius is not configured.

### Example

* Api Key Authentication (ApiKeyAuth):

```python
import sipher_client
from sipher_client.models.scan_assets200_response import ScanAssets200Response
from sipher_client.models.scan_assets_request import ScanAssetsRequest
from sipher_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to https://sipher.sip-protocol.org
# See configuration.py for a list of all supported configuration parameters.
configuration = sipher_client.Configuration(
    host = "https://sipher.sip-protocol.org"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure API key authorization: ApiKeyAuth
configuration.api_key['ApiKeyAuth'] = os.environ["API_KEY"]

# Uncomment below to setup prefix (e.g. Bearer) for API key, if needed
# configuration.api_key_prefix['ApiKeyAuth'] = 'Bearer'

# Enter a context with an instance of the API client
with sipher_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = sipher_client.ScanApi(api_client)
    scan_assets_request = sipher_client.ScanAssetsRequest() # ScanAssetsRequest | 

    try:
        # Scan stealth address assets via Helius DAS
        api_response = api_instance.scan_assets(scan_assets_request)
        print("The response of ScanApi->scan_assets:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ScanApi->scan_assets: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **scan_assets_request** | [**ScanAssetsRequest**](ScanAssetsRequest.md)|  | 

### Return type

[**ScanAssets200Response**](ScanAssets200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Asset list |  -  |
**400** | Invalid address |  -  |
**503** | Helius DAS unavailable |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **scan_payments**
> ScanPayments200Response scan_payments(scan_payments_request)

Scan for incoming shielded payments

Scans Solana for SIP announcements matching the provided viewing key.

### Example

* Api Key Authentication (ApiKeyAuth):

```python
import sipher_client
from sipher_client.models.scan_payments200_response import ScanPayments200Response
from sipher_client.models.scan_payments_request import ScanPaymentsRequest
from sipher_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to https://sipher.sip-protocol.org
# See configuration.py for a list of all supported configuration parameters.
configuration = sipher_client.Configuration(
    host = "https://sipher.sip-protocol.org"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure API key authorization: ApiKeyAuth
configuration.api_key['ApiKeyAuth'] = os.environ["API_KEY"]

# Uncomment below to setup prefix (e.g. Bearer) for API key, if needed
# configuration.api_key_prefix['ApiKeyAuth'] = 'Bearer'

# Enter a context with an instance of the API client
with sipher_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = sipher_client.ScanApi(api_client)
    scan_payments_request = sipher_client.ScanPaymentsRequest() # ScanPaymentsRequest | 

    try:
        # Scan for incoming shielded payments
        api_response = api_instance.scan_payments(scan_payments_request)
        print("The response of ScanApi->scan_payments:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ScanApi->scan_payments: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **scan_payments_request** | [**ScanPaymentsRequest**](ScanPaymentsRequest.md)|  | 

### Return type

[**ScanPayments200Response**](ScanPayments200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Scan results |  -  |
**400** | Validation error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **scan_payments_batch**
> ScanPaymentsBatch200Response scan_payments_batch(scan_payments_batch_request)

Batch scan for payments across multiple key pairs

Scan for incoming shielded payments across multiple viewing key pairs. Max 100 key pairs per request.

### Example

* Api Key Authentication (ApiKeyAuth):

```python
import sipher_client
from sipher_client.models.scan_payments_batch200_response import ScanPaymentsBatch200Response
from sipher_client.models.scan_payments_batch_request import ScanPaymentsBatchRequest
from sipher_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to https://sipher.sip-protocol.org
# See configuration.py for a list of all supported configuration parameters.
configuration = sipher_client.Configuration(
    host = "https://sipher.sip-protocol.org"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure API key authorization: ApiKeyAuth
configuration.api_key['ApiKeyAuth'] = os.environ["API_KEY"]

# Uncomment below to setup prefix (e.g. Bearer) for API key, if needed
# configuration.api_key_prefix['ApiKeyAuth'] = 'Bearer'

# Enter a context with an instance of the API client
with sipher_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = sipher_client.ScanApi(api_client)
    scan_payments_batch_request = sipher_client.ScanPaymentsBatchRequest() # ScanPaymentsBatchRequest | 

    try:
        # Batch scan for payments across multiple key pairs
        api_response = api_instance.scan_payments_batch(scan_payments_batch_request)
        print("The response of ScanApi->scan_payments_batch:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ScanApi->scan_payments_batch: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **scan_payments_batch_request** | [**ScanPaymentsBatchRequest**](ScanPaymentsBatchRequest.md)|  | 

### Return type

[**ScanPaymentsBatch200Response**](ScanPaymentsBatch200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Batch scan results |  -  |
**400** | Validation error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

