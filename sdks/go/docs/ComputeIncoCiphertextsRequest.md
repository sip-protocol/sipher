# ComputeIncoCiphertextsRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Operation** | **string** | Homomorphic operation | 
**Ciphertexts** | **[]string** | Ciphertexts to operate on | 
**Scheme** | Pointer to **string** |  | [optional] [default to "tfhe"]

## Methods

### NewComputeIncoCiphertextsRequest

`func NewComputeIncoCiphertextsRequest(operation string, ciphertexts []string, ) *ComputeIncoCiphertextsRequest`

NewComputeIncoCiphertextsRequest instantiates a new ComputeIncoCiphertextsRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewComputeIncoCiphertextsRequestWithDefaults

`func NewComputeIncoCiphertextsRequestWithDefaults() *ComputeIncoCiphertextsRequest`

NewComputeIncoCiphertextsRequestWithDefaults instantiates a new ComputeIncoCiphertextsRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetOperation

`func (o *ComputeIncoCiphertextsRequest) GetOperation() string`

GetOperation returns the Operation field if non-nil, zero value otherwise.

### GetOperationOk

`func (o *ComputeIncoCiphertextsRequest) GetOperationOk() (*string, bool)`

GetOperationOk returns a tuple with the Operation field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOperation

`func (o *ComputeIncoCiphertextsRequest) SetOperation(v string)`

SetOperation sets Operation field to given value.


### GetCiphertexts

`func (o *ComputeIncoCiphertextsRequest) GetCiphertexts() []string`

GetCiphertexts returns the Ciphertexts field if non-nil, zero value otherwise.

### GetCiphertextsOk

`func (o *ComputeIncoCiphertextsRequest) GetCiphertextsOk() (*[]string, bool)`

GetCiphertextsOk returns a tuple with the Ciphertexts field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCiphertexts

`func (o *ComputeIncoCiphertextsRequest) SetCiphertexts(v []string)`

SetCiphertexts sets Ciphertexts field to given value.


### GetScheme

`func (o *ComputeIncoCiphertextsRequest) GetScheme() string`

GetScheme returns the Scheme field if non-nil, zero value otherwise.

### GetSchemeOk

`func (o *ComputeIncoCiphertextsRequest) GetSchemeOk() (*string, bool)`

GetSchemeOk returns a tuple with the Scheme field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetScheme

`func (o *ComputeIncoCiphertextsRequest) SetScheme(v string)`

SetScheme sets Scheme field to given value.

### HasScheme

`func (o *ComputeIncoCiphertextsRequest) HasScheme() bool`

HasScheme returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


