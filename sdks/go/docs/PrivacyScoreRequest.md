# PrivacyScoreRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Address** | **string** | Base58-encoded Solana public key | 
**Limit** | Pointer to **int32** | Number of recent transactions to analyze | [optional] [default to 100]

## Methods

### NewPrivacyScoreRequest

`func NewPrivacyScoreRequest(address string, ) *PrivacyScoreRequest`

NewPrivacyScoreRequest instantiates a new PrivacyScoreRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewPrivacyScoreRequestWithDefaults

`func NewPrivacyScoreRequestWithDefaults() *PrivacyScoreRequest`

NewPrivacyScoreRequestWithDefaults instantiates a new PrivacyScoreRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetAddress

`func (o *PrivacyScoreRequest) GetAddress() string`

GetAddress returns the Address field if non-nil, zero value otherwise.

### GetAddressOk

`func (o *PrivacyScoreRequest) GetAddressOk() (*string, bool)`

GetAddressOk returns a tuple with the Address field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAddress

`func (o *PrivacyScoreRequest) SetAddress(v string)`

SetAddress sets Address field to given value.


### GetLimit

`func (o *PrivacyScoreRequest) GetLimit() int32`

GetLimit returns the Limit field if non-nil, zero value otherwise.

### GetLimitOk

`func (o *PrivacyScoreRequest) GetLimitOk() (*int32, bool)`

GetLimitOk returns a tuple with the Limit field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLimit

`func (o *PrivacyScoreRequest) SetLimit(v int32)`

SetLimit sets Limit field to given value.

### HasLimit

`func (o *PrivacyScoreRequest) HasLimit() bool`

HasLimit returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


