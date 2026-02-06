# DecryptArciumResultRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ComputationId** | **string** |  | 
**ViewingKey** | [**DecryptArciumResultRequestViewingKey**](DecryptArciumResultRequestViewingKey.md) |  | 

## Methods

### NewDecryptArciumResultRequest

`func NewDecryptArciumResultRequest(computationId string, viewingKey DecryptArciumResultRequestViewingKey, ) *DecryptArciumResultRequest`

NewDecryptArciumResultRequest instantiates a new DecryptArciumResultRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewDecryptArciumResultRequestWithDefaults

`func NewDecryptArciumResultRequestWithDefaults() *DecryptArciumResultRequest`

NewDecryptArciumResultRequestWithDefaults instantiates a new DecryptArciumResultRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetComputationId

`func (o *DecryptArciumResultRequest) GetComputationId() string`

GetComputationId returns the ComputationId field if non-nil, zero value otherwise.

### GetComputationIdOk

`func (o *DecryptArciumResultRequest) GetComputationIdOk() (*string, bool)`

GetComputationIdOk returns a tuple with the ComputationId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetComputationId

`func (o *DecryptArciumResultRequest) SetComputationId(v string)`

SetComputationId sets ComputationId field to given value.


### GetViewingKey

`func (o *DecryptArciumResultRequest) GetViewingKey() DecryptArciumResultRequestViewingKey`

GetViewingKey returns the ViewingKey field if non-nil, zero value otherwise.

### GetViewingKeyOk

`func (o *DecryptArciumResultRequest) GetViewingKeyOk() (*DecryptArciumResultRequestViewingKey, bool)`

GetViewingKeyOk returns a tuple with the ViewingKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingKey

`func (o *DecryptArciumResultRequest) SetViewingKey(v DecryptArciumResultRequestViewingKey)`

SetViewingKey sets ViewingKey field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


