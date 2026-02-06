# \ProofsAPI

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ProofsFulfillmentGenerate**](ProofsAPI.md#ProofsFulfillmentGenerate) | **Post** /v1/proofs/fulfillment/generate | Generate fulfillment proof
[**ProofsFulfillmentVerify**](ProofsAPI.md#ProofsFulfillmentVerify) | **Post** /v1/proofs/fulfillment/verify | Verify fulfillment proof
[**ProofsFundingGenerate**](ProofsAPI.md#ProofsFundingGenerate) | **Post** /v1/proofs/funding/generate | Generate funding proof
[**ProofsFundingVerify**](ProofsAPI.md#ProofsFundingVerify) | **Post** /v1/proofs/funding/verify | Verify funding proof
[**ProofsRangeGenerate**](ProofsAPI.md#ProofsRangeGenerate) | **Post** /v1/proofs/range/generate | Generate STARK range proof
[**ProofsRangeVerify**](ProofsAPI.md#ProofsRangeVerify) | **Post** /v1/proofs/range/verify | Verify STARK range proof
[**ProofsValidityGenerate**](ProofsAPI.md#ProofsValidityGenerate) | **Post** /v1/proofs/validity/generate | Generate validity proof
[**ProofsValidityVerify**](ProofsAPI.md#ProofsValidityVerify) | **Post** /v1/proofs/validity/verify | Verify validity proof



## ProofsFulfillmentGenerate

> ProofsFulfillmentGenerate200Response ProofsFulfillmentGenerate(ctx).ProofsFulfillmentGenerateRequest(proofsFulfillmentGenerateRequest).Execute()

Generate fulfillment proof



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
	proofsFulfillmentGenerateRequest := *openapiclient.NewProofsFulfillmentGenerateRequest("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "OutputAmount_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "MinOutputAmount_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "SolverId_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", *openapiclient.NewProofsFulfillmentGenerateRequestOracleAttestation("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "Amount_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "BlockNumber_example", "Signature_example"), int32(123), int32(123)) // ProofsFulfillmentGenerateRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProofsAPI.ProofsFulfillmentGenerate(context.Background()).ProofsFulfillmentGenerateRequest(proofsFulfillmentGenerateRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProofsAPI.ProofsFulfillmentGenerate``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ProofsFulfillmentGenerate`: ProofsFulfillmentGenerate200Response
	fmt.Fprintf(os.Stdout, "Response from `ProofsAPI.ProofsFulfillmentGenerate`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiProofsFulfillmentGenerateRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **proofsFulfillmentGenerateRequest** | [**ProofsFulfillmentGenerateRequest**](ProofsFulfillmentGenerateRequest.md) |  | 

### Return type

[**ProofsFulfillmentGenerate200Response**](ProofsFulfillmentGenerate200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ProofsFulfillmentVerify

> CommitmentVerify200Response ProofsFulfillmentVerify(ctx).ProofsFulfillmentVerifyRequest(proofsFulfillmentVerifyRequest).Execute()

Verify fulfillment proof



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
	proofsFulfillmentVerifyRequest := *openapiclient.NewProofsFulfillmentVerifyRequest("Type_example", "Proof_example", []string{"PublicInputs_example"}) // ProofsFulfillmentVerifyRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProofsAPI.ProofsFulfillmentVerify(context.Background()).ProofsFulfillmentVerifyRequest(proofsFulfillmentVerifyRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProofsAPI.ProofsFulfillmentVerify``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ProofsFulfillmentVerify`: CommitmentVerify200Response
	fmt.Fprintf(os.Stdout, "Response from `ProofsAPI.ProofsFulfillmentVerify`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiProofsFulfillmentVerifyRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **proofsFulfillmentVerifyRequest** | [**ProofsFulfillmentVerifyRequest**](ProofsFulfillmentVerifyRequest.md) |  | 

### Return type

[**CommitmentVerify200Response**](CommitmentVerify200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ProofsFundingGenerate

> ProofsFundingGenerate200Response ProofsFundingGenerate(ctx).ProofsFundingGenerateRequest(proofsFundingGenerateRequest).Execute()

Generate funding proof



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
	proofsFundingGenerateRequest := *openapiclient.NewProofsFundingGenerateRequest("Balance_example", "MinimumRequired_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "AssetId_example", "UserAddress_example", "OwnershipSignature_example") // ProofsFundingGenerateRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProofsAPI.ProofsFundingGenerate(context.Background()).ProofsFundingGenerateRequest(proofsFundingGenerateRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProofsAPI.ProofsFundingGenerate``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ProofsFundingGenerate`: ProofsFundingGenerate200Response
	fmt.Fprintf(os.Stdout, "Response from `ProofsAPI.ProofsFundingGenerate`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiProofsFundingGenerateRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **proofsFundingGenerateRequest** | [**ProofsFundingGenerateRequest**](ProofsFundingGenerateRequest.md) |  | 

### Return type

[**ProofsFundingGenerate200Response**](ProofsFundingGenerate200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ProofsFundingVerify

> CommitmentVerify200Response ProofsFundingVerify(ctx).ProofsFundingVerifyRequest(proofsFundingVerifyRequest).Execute()

Verify funding proof



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
	proofsFundingVerifyRequest := *openapiclient.NewProofsFundingVerifyRequest("Type_example", "Proof_example", []string{"PublicInputs_example"}) // ProofsFundingVerifyRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProofsAPI.ProofsFundingVerify(context.Background()).ProofsFundingVerifyRequest(proofsFundingVerifyRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProofsAPI.ProofsFundingVerify``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ProofsFundingVerify`: CommitmentVerify200Response
	fmt.Fprintf(os.Stdout, "Response from `ProofsAPI.ProofsFundingVerify`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiProofsFundingVerifyRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **proofsFundingVerifyRequest** | [**ProofsFundingVerifyRequest**](ProofsFundingVerifyRequest.md) |  | 

### Return type

[**CommitmentVerify200Response**](CommitmentVerify200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ProofsRangeGenerate

> ProofsRangeGenerate200Response ProofsRangeGenerate(ctx).ProofsRangeGenerateRequest(proofsRangeGenerateRequest).Execute()

Generate STARK range proof



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
	proofsRangeGenerateRequest := *openapiclient.NewProofsRangeGenerateRequest("Value_example", "Threshold_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") // ProofsRangeGenerateRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProofsAPI.ProofsRangeGenerate(context.Background()).ProofsRangeGenerateRequest(proofsRangeGenerateRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProofsAPI.ProofsRangeGenerate``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ProofsRangeGenerate`: ProofsRangeGenerate200Response
	fmt.Fprintf(os.Stdout, "Response from `ProofsAPI.ProofsRangeGenerate`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiProofsRangeGenerateRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **proofsRangeGenerateRequest** | [**ProofsRangeGenerateRequest**](ProofsRangeGenerateRequest.md) |  | 

### Return type

[**ProofsRangeGenerate200Response**](ProofsRangeGenerate200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ProofsRangeVerify

> CommitmentVerify200Response ProofsRangeVerify(ctx).ProofsRangeVerifyRequest(proofsRangeVerifyRequest).Execute()

Verify STARK range proof



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
	proofsRangeVerifyRequest := *openapiclient.NewProofsRangeVerifyRequest("Type_example", "Proof_example", []string{"PublicInputs_example"}) // ProofsRangeVerifyRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProofsAPI.ProofsRangeVerify(context.Background()).ProofsRangeVerifyRequest(proofsRangeVerifyRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProofsAPI.ProofsRangeVerify``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ProofsRangeVerify`: CommitmentVerify200Response
	fmt.Fprintf(os.Stdout, "Response from `ProofsAPI.ProofsRangeVerify`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiProofsRangeVerifyRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **proofsRangeVerifyRequest** | [**ProofsRangeVerifyRequest**](ProofsRangeVerifyRequest.md) |  | 

### Return type

[**CommitmentVerify200Response**](CommitmentVerify200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ProofsValidityGenerate

> ProofsValidityGenerate200Response ProofsValidityGenerate(ctx).ProofsValidityGenerateRequest(proofsValidityGenerateRequest).Execute()

Generate validity proof



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
	proofsValidityGenerateRequest := *openapiclient.NewProofsValidityGenerateRequest("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "SenderAddress_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "AuthorizationSignature_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", int32(123), int32(123)) // ProofsValidityGenerateRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProofsAPI.ProofsValidityGenerate(context.Background()).ProofsValidityGenerateRequest(proofsValidityGenerateRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProofsAPI.ProofsValidityGenerate``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ProofsValidityGenerate`: ProofsValidityGenerate200Response
	fmt.Fprintf(os.Stdout, "Response from `ProofsAPI.ProofsValidityGenerate`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiProofsValidityGenerateRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **proofsValidityGenerateRequest** | [**ProofsValidityGenerateRequest**](ProofsValidityGenerateRequest.md) |  | 

### Return type

[**ProofsValidityGenerate200Response**](ProofsValidityGenerate200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ProofsValidityVerify

> CommitmentVerify200Response ProofsValidityVerify(ctx).ProofsValidityVerifyRequest(proofsValidityVerifyRequest).Execute()

Verify validity proof



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
	proofsValidityVerifyRequest := *openapiclient.NewProofsValidityVerifyRequest("Type_example", "Proof_example", []string{"PublicInputs_example"}) // ProofsValidityVerifyRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProofsAPI.ProofsValidityVerify(context.Background()).ProofsValidityVerifyRequest(proofsValidityVerifyRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProofsAPI.ProofsValidityVerify``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ProofsValidityVerify`: CommitmentVerify200Response
	fmt.Fprintf(os.Stdout, "Response from `ProofsAPI.ProofsValidityVerify`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiProofsValidityVerifyRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **proofsValidityVerifyRequest** | [**ProofsValidityVerifyRequest**](ProofsValidityVerifyRequest.md) |  | 

### Return type

[**CommitmentVerify200Response**](CommitmentVerify200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

