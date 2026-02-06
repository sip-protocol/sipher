# \ComplianceAPI

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ComplianceDisclose**](ComplianceAPI.md#ComplianceDisclose) | **Post** /v1/compliance/disclose | Selective disclosure with scoped viewing key (enterprise)
[**ComplianceReport**](ComplianceAPI.md#ComplianceReport) | **Post** /v1/compliance/report | Generate encrypted audit report (enterprise)
[**GetComplianceReport**](ComplianceAPI.md#GetComplianceReport) | **Get** /v1/compliance/report/{id} | Retrieve generated compliance report (enterprise)



## ComplianceDisclose

> ComplianceDisclose200Response ComplianceDisclose(ctx).ComplianceDiscloseRequest(complianceDiscloseRequest).Execute()

Selective disclosure with scoped viewing key (enterprise)



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID/sipher"
)

func main() {
	complianceDiscloseRequest := *openapiclient.NewComplianceDiscloseRequest(*openapiclient.NewViewingKey("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "Path_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"), *openapiclient.NewComplianceDiscloseRequestTransactionData("TxHash_example", "Amount_example", "Sender_example", "Receiver_example"), *openapiclient.NewComplianceDiscloseRequestScope("Type_example"), "AuditorId_example", *openapiclient.NewComplianceDiscloseRequestAuditorVerification("AuditorKeyHash_example", "Nonce_example")) // ComplianceDiscloseRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ComplianceAPI.ComplianceDisclose(context.Background()).ComplianceDiscloseRequest(complianceDiscloseRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ComplianceAPI.ComplianceDisclose``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ComplianceDisclose`: ComplianceDisclose200Response
	fmt.Fprintf(os.Stdout, "Response from `ComplianceAPI.ComplianceDisclose`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiComplianceDiscloseRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **complianceDiscloseRequest** | [**ComplianceDiscloseRequest**](ComplianceDiscloseRequest.md) |  | 

### Return type

[**ComplianceDisclose200Response**](ComplianceDisclose200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ComplianceReport

> ComplianceReport200Response ComplianceReport(ctx).ComplianceReportRequest(complianceReportRequest).Execute()

Generate encrypted audit report (enterprise)



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID/sipher"
)

func main() {
	complianceReportRequest := *openapiclient.NewComplianceReportRequest(*openapiclient.NewViewingKey("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "Path_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"), int32(123), int32(123), "AuditorId_example", *openapiclient.NewComplianceDiscloseRequestAuditorVerification("AuditorKeyHash_example", "Nonce_example")) // ComplianceReportRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ComplianceAPI.ComplianceReport(context.Background()).ComplianceReportRequest(complianceReportRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ComplianceAPI.ComplianceReport``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ComplianceReport`: ComplianceReport200Response
	fmt.Fprintf(os.Stdout, "Response from `ComplianceAPI.ComplianceReport`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiComplianceReportRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **complianceReportRequest** | [**ComplianceReportRequest**](ComplianceReportRequest.md) |  | 

### Return type

[**ComplianceReport200Response**](ComplianceReport200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetComplianceReport

> GetComplianceReport200Response GetComplianceReport(ctx, id).Execute()

Retrieve generated compliance report (enterprise)



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID/sipher"
)

func main() {
	id := "id_example" // string | Report ID returned from POST /v1/compliance/report

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ComplianceAPI.GetComplianceReport(context.Background(), id).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ComplianceAPI.GetComplianceReport``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetComplianceReport`: GetComplianceReport200Response
	fmt.Fprintf(os.Stdout, "Response from `ComplianceAPI.GetComplianceReport`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** | Report ID returned from POST /v1/compliance/report | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetComplianceReportRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

[**GetComplianceReport200Response**](GetComplianceReport200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

