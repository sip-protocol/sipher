# ProofsFundingGenerateRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Balance** | **string** | User balance (private) | 
**MinimumRequired** | **string** | Minimum required amount (public) | 
**BlindingFactor** | **string** | 0x-prefixed 32-byte hex string | 
**AssetId** | **string** | Asset identifier (e.g., SOL) | 
**UserAddress** | **string** | User address for ownership proof | 
**OwnershipSignature** | **string** | Signature proving address ownership | 

## Methods

### NewProofsFundingGenerateRequest

`func NewProofsFundingGenerateRequest(balance string, minimumRequired string, blindingFactor string, assetId string, userAddress string, ownershipSignature string, ) *ProofsFundingGenerateRequest`

NewProofsFundingGenerateRequest instantiates a new ProofsFundingGenerateRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewProofsFundingGenerateRequestWithDefaults

`func NewProofsFundingGenerateRequestWithDefaults() *ProofsFundingGenerateRequest`

NewProofsFundingGenerateRequestWithDefaults instantiates a new ProofsFundingGenerateRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetBalance

`func (o *ProofsFundingGenerateRequest) GetBalance() string`

GetBalance returns the Balance field if non-nil, zero value otherwise.

### GetBalanceOk

`func (o *ProofsFundingGenerateRequest) GetBalanceOk() (*string, bool)`

GetBalanceOk returns a tuple with the Balance field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBalance

`func (o *ProofsFundingGenerateRequest) SetBalance(v string)`

SetBalance sets Balance field to given value.


### GetMinimumRequired

`func (o *ProofsFundingGenerateRequest) GetMinimumRequired() string`

GetMinimumRequired returns the MinimumRequired field if non-nil, zero value otherwise.

### GetMinimumRequiredOk

`func (o *ProofsFundingGenerateRequest) GetMinimumRequiredOk() (*string, bool)`

GetMinimumRequiredOk returns a tuple with the MinimumRequired field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMinimumRequired

`func (o *ProofsFundingGenerateRequest) SetMinimumRequired(v string)`

SetMinimumRequired sets MinimumRequired field to given value.


### GetBlindingFactor

`func (o *ProofsFundingGenerateRequest) GetBlindingFactor() string`

GetBlindingFactor returns the BlindingFactor field if non-nil, zero value otherwise.

### GetBlindingFactorOk

`func (o *ProofsFundingGenerateRequest) GetBlindingFactorOk() (*string, bool)`

GetBlindingFactorOk returns a tuple with the BlindingFactor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBlindingFactor

`func (o *ProofsFundingGenerateRequest) SetBlindingFactor(v string)`

SetBlindingFactor sets BlindingFactor field to given value.


### GetAssetId

`func (o *ProofsFundingGenerateRequest) GetAssetId() string`

GetAssetId returns the AssetId field if non-nil, zero value otherwise.

### GetAssetIdOk

`func (o *ProofsFundingGenerateRequest) GetAssetIdOk() (*string, bool)`

GetAssetIdOk returns a tuple with the AssetId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAssetId

`func (o *ProofsFundingGenerateRequest) SetAssetId(v string)`

SetAssetId sets AssetId field to given value.


### GetUserAddress

`func (o *ProofsFundingGenerateRequest) GetUserAddress() string`

GetUserAddress returns the UserAddress field if non-nil, zero value otherwise.

### GetUserAddressOk

`func (o *ProofsFundingGenerateRequest) GetUserAddressOk() (*string, bool)`

GetUserAddressOk returns a tuple with the UserAddress field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserAddress

`func (o *ProofsFundingGenerateRequest) SetUserAddress(v string)`

SetUserAddress sets UserAddress field to given value.


### GetOwnershipSignature

`func (o *ProofsFundingGenerateRequest) GetOwnershipSignature() string`

GetOwnershipSignature returns the OwnershipSignature field if non-nil, zero value otherwise.

### GetOwnershipSignatureOk

`func (o *ProofsFundingGenerateRequest) GetOwnershipSignatureOk() (*string, bool)`

GetOwnershipSignatureOk returns a tuple with the OwnershipSignature field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOwnershipSignature

`func (o *ProofsFundingGenerateRequest) SetOwnershipSignature(v string)`

SetOwnershipSignature sets OwnershipSignature field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


